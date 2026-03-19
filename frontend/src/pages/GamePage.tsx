import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGameStore } from '../stores/game'
import { gameWs } from '../api/ws'
import { api } from '../api/http'
import { gameAudio } from '../audio/sounds'
import AnimalAvatar from '../components/AnimalAvatar'

interface User {
  id: string
  username: string
  avatar: string
}

interface GamePageProps {
  user: User
}

export default function GamePage({ user }: GamePageProps) {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const {
    mode,
    players,
    gameStarted,
    maxPlayers,
    phase,
    roundNumber,
    currentTurn,
    yourDice,
    yourHand,
    tableCard,
    currentBid,
    bidHistory,
    eliminated,
    winnerId,
    rouletteResult,
    revealedCards,
    revealedDice,
    gameOver,
    showLiarCall,
    setRoomState,
    setGameState,
    setRouletteResult,
    setRevealedCards,
    setRevealedDice,
    setGameOver,
    setLiarCalled,
    clearAnimations,
    playDiceRoll,
    playCardFlip,
    playLiarSting,
    reset,
  } = useGameStore()

  const [connected, setConnected] = useState(false)
  const [bidQuantity, setBidQuantity] = useState(1)
  const [bidFace, setBidFace] = useState(2)
  const [selectedCards, setSelectedCards] = useState<number[]>([])
  const [showTurnIndicator, setShowTurnIndicator] = useState(false)
  const [copied, setCopied] = useState(false)
  const [agentMode, setAgentMode] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)

  // TTS function - uses SecondMe TTS API
  const speak = async (text: string) => {
    if (!voiceEnabled) return

    // Try using SecondMe TTS API first
    try {
      console.log('[TTS] Calling SecondMe TTS API with text:', text)
      const audioBlob = await api.speak(text)
      console.log('[TTS] Received audio blob, size:', audioBlob.size)
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      audio.onended = () => URL.revokeObjectURL(audioUrl)
      await audio.play()
    } catch (err) {
      // Fallback to browser TTS
      console.warn('[TTS] SecondMe TTS failed, using browser TTS:', err)
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'zh-CN'
      utterance.rate = 1.0
      speechSynthesis.speak(utterance)
    }
  }

  // Enable agent mode - tells server to use AI for this player
  const enableAgentMode = () => {
    setAgentMode(true)
    gameWs.send('enable_agent', {})
    speak('已启用 Agent 模式，将自动为您出牌')
  }

  // Disable agent mode
  const disableAgentMode = () => {
    setAgentMode(false)
    gameWs.send('disable_agent', {})
    speak('已关闭 Agent 模式')
  }

  // Connect to WebSocket
  useEffect(() => {
    if (!roomId) return

    const token = localStorage.getItem('token')
    if (!token) return

    const connect = async () => {
      try {
        await gameWs.connect(roomId, token)
        setConnected(true)
      } catch (err) {
        console.error('Failed to connect:', err)
      }
    }

    connect()

    return () => {
      gameWs.disconnect()
    }
  }, [roomId])

  // Set up event handlers
  useEffect(() => {
    const handleRoomState = (data: any) => {
      setRoomState({
        mode: data.mode,
        players: data.players,
        gameStarted: data.game_started,
        maxPlayers: data.max_players || 8,
      })
    }

    const handleGameStart = () => {
      gameAudio.init()
      setGameState({ gameStarted: true })
      clearAnimations()
    }

    const handleGameState = (data: any) => {
      // Show turn indicator when turn changes
      if (data.current_turn && data.current_turn !== currentTurn) {
        setShowTurnIndicator(true)
        setTimeout(() => setShowTurnIndicator(false), 2000)
      }
      setGameState({
        phase: data.phase,
        roundNumber: data.round_number,
        currentTurn: data.current_turn,
        yourDice: data.your_dice || [],
        yourHand: data.your_hand || [],
        tableCard: data.table_card || '',
        currentBid: data.current_bid,
        bidHistory: data.bid_history || [],
        players: data.players,
        eliminated: data.eliminated || [],
      })
    }

    const handleGameOver = (data: any) => {
      setGameOver({
        winner_id: data.winner_id,
        winner_nickname: data.winner_nickname || '',
        winner_avatar: data.winner_avatar,
      })
    }

    // Roulette events
    const handleRouletteResult = (data: any) => {
      setRouletteResult({
        player_id: data.player_id,
        survived: data.survived,
        shots_fired: data.shots_fired,
        chambers: data.chambers || 6,
      })
      setTimeout(() => setRouletteResult(null), 3000)
    }

    // Dice reveal events
    const handleDiceRevealed = (data: any) => {
      playDiceRoll()
      setRevealedDice({
        all_dice: data.all_dice || {},
        actual_count: data.actual_count,
        bid_was_correct: data.bid_was_correct,
        challenger_id: data.challenger_id,
        challenged_id: data.challenged_id,
      })
      setTimeout(() => setRevealedDice(null), 4000)
    }

    // Card reveal events
    const handleCardsRevealed = (data: any) => {
      playCardFlip()
      setRevealedCards({
        cards: data.cards || [],
        was_lying: data.was_lying,
        challenger_id: data.challenger_id,
        challenged_id: data.challenged_id,
      })
      setTimeout(() => setRevealedCards(null), 4000)
    }

    // Liar called
    const handleLiarCalled = (data: any) => {
      playLiarSting()
      setLiarCalled({ caller_id: data.caller_id })
      setTimeout(() => setLiarCalled(null), 2000)
    }

    // Round starting
    const handleRoundStarting = () => {
      clearAnimations()
    }

    // TTS message from server
    const handleTTS = (data: any) => {
      const message = data.message
      if (message && voiceEnabled) {
        speak(message)
      }
    }

    gameWs.on('room_state', handleRoomState)
    gameWs.on('game_start', handleGameStart)
    gameWs.on('game_state', handleGameState)
    gameWs.on('game_over', handleGameOver)
    gameWs.on('roulette_result', handleRouletteResult)
    gameWs.on('dice_revealed', handleDiceRevealed)
    gameWs.on('cards_revealed', handleCardsRevealed)
    gameWs.on('liar_called', handleLiarCalled)
    gameWs.on('round_starting', handleRoundStarting)
    gameWs.on('tts', handleTTS)

    return () => {
      gameWs.off('room_state', handleRoomState)
      gameWs.off('game_start', handleGameStart)
      gameWs.off('game_state', handleGameState)
      gameWs.off('game_over', handleGameOver)
      gameWs.off('roulette_result', handleRouletteResult)
      gameWs.off('dice_revealed', handleDiceRevealed)
      gameWs.off('cards_revealed', handleCardsRevealed)
      gameWs.off('liar_called', handleLiarCalled)
      gameWs.off('round_starting', handleRoundStarting)
      gameWs.off('tts', handleTTS)
    }
  }, [setRoomState, setGameState, setRouletteResult, setRevealedCards, setRevealedDice, setGameOver, setLiarCalled, clearAnimations, currentTurn, voiceEnabled])

  const handleStartGame = () => {
    gameWs.send('start_game', {})
  }

  const handlePlaceBid = () => {
    gameWs.send('player_action', {
      action: 'place_bid',
      data: { quantity: bidQuantity, face_value: bidFace },
    })
  }

  const handleChallengeBid = () => {
    gameWs.send('player_action', {
      action: 'challenge_bid',
      data: {},
    })
  }

  const handlePlayCards = () => {
    if (selectedCards.length === 0) return
    gameWs.send('player_action', {
      action: 'play_cards',
      data: { cards: selectedCards },
    })
    setSelectedCards([])
  }

  const handleCallLiar = () => {
    gameWs.send('player_action', {
      action: 'call_liar',
      data: {},
    })
  }

  const handleLeave = () => {
    reset()
    navigate('/lobby')
  }

  const handleCopyLink = () => {
    const link = `${window.location.origin}/game/${roomId}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Function to manually refresh room state
  const refreshRoomState = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token || !roomId) return

      // Call the API to get fresh room data
      const response = await fetch(`/api/lobby/rooms`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()

      // Find our room in the list and update the state
      const room = data.rooms?.find((r: any) => r.room_id === roomId)
      if (room) {
        setRoomState({
          mode: room.mode,
          players: room.players || [],
          gameStarted: room.game_started || false,
        })
      }
    } catch (err) {
      console.error('Failed to refresh room:', err)
    }
  }

  // Auto-refresh when page becomes visible (e.g., user returns from another tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && !gameStarted) {
        refreshRoomState()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [roomId, gameStarted])

  const handleAddBot = async () => {
    const token = localStorage.getItem('token')
    if (!token || !roomId) return

    try {
      await api.addBots(roomId, token, 1)
      // Refresh room state after adding bot
      setTimeout(refreshRoomState, 500)
    } catch (err) {
      console.error('Failed to add bot:', err)
    }
  }

  const handleAddBots = async () => {
    const token = localStorage.getItem('token')
    if (!token || !roomId) return

    try {
      const currentPlayers = players.length
      const needed = Math.min(3, maxPlayers - currentPlayers)
      await api.addBots(roomId, token, needed)
      // Refresh room state after adding bots
      setTimeout(refreshRoomState, 500)
    } catch (err) {
      console.error('Failed to add bots:', err)
    }
  }

  const isMyTurn = currentTurn === user?.id

  if (!connected) {
    return (
      <div className="min-h-dvh flex flex-col bg-noise table-felt">
        <div className="ambient-light" />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2">
            <span className="text-accent-gold/50 text-xl animate-pulse">Loading</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex flex-col p-4 bg-noise table-felt">
      <div className="ambient-light" />

      {/* Turn Indicator */}
      {showTurnIndicator && isMyTurn && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
          <div className="bg-accent-gold text-bg-primary px-8 py-4 rounded-xl text-xl font-bold animate-[fade-in-out_2s_ease-in-out]">
            轮到你了!
          </div>
        </div>
      )}

      {/* Liar Call Animation */}
      {showLiarCall && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-[100]">
          <div className="text-accent-red text-7xl font-black animate-[liar-pulse_0.5s_ease-in-out_infinite] text-glow-red">
            LIAR!
          </div>
        </div>
      )}

      {/* Roulette Result Overlay */}
      {rouletteResult && (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-black/85 z-[100]">
          <RevolverSVG
            chambers={rouletteResult.chambers}
            shotsFired={rouletteResult.shots_fired}
            survived={rouletteResult.survived}
            spinning={true}
            hammerFall={true}
            showFlash={!rouletteResult.survived}
          />
          <div className="text-accent-gold text-3xl font-bold mt-4">
            {rouletteResult.survived ? '生存!' : '淘汰!'}
          </div>
        </div>
      )}

      {/* Revealed Dice Display */}
      {revealedDice && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/85 z-[100]">
          <div className="bg-bg-surface border border-border-subtle rounded-2xl p-8 text-center max-w-lg">
            <h3 className="text-xl font-accent text-accent-gold mb-4">骰子揭晓</h3>

            {/* Show all dice */}
            {revealedDice.all_dice && Object.keys(revealedDice.all_dice).length > 0 && (
              <div className="mb-4 space-y-3">
                {Object.entries(revealedDice.all_dice).map(([playerId, dice]) => (
                  <div key={playerId} className="flex flex-col items-center">
                    <span className="text-text-secondary text-sm mb-2">{playerId}</span>
                    <div className="flex gap-1 flex-wrap justify-center">
                      {dice.map((die, i) => (
                        <div key={i} className={`die die-${die}`}>
                          {Array.from({ length: die }).map((_, j) => (
                            <div key={j} className="die-pip" />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-text-primary text-xl mb-2 font-bold">
              实际数量: <span className="text-accent-gold">{revealedDice.actual_count}</span>
            </p>
            <p className={`text-2xl font-bold ${revealedDice.bid_was_correct ? 'text-accent-green' : 'text-accent-red'}`}>
              {revealedDice.bid_was_correct ? '报价正确!' : '报价错误!'}
            </p>
          </div>
        </div>
      )}

      {/* Revealed Cards Display */}
      {revealedCards && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/85 z-[100]">
          <div className="bg-bg-surface border border-border-subtle rounded-2xl p-8 text-center">
            <h3 className="text-xl font-accent text-accent-gold mb-4">纸牌揭晓</h3>
            <div className="flex gap-4 justify-center mb-4">
              {revealedCards.cards.map((card, i) => (
                <div key={i} className="card-front w-16 h-24 flex items-center justify-center text-xl font-bold animate-[card-flip-in_0.5s_ease-out]" style={{ animationDelay: `${i * 0.2}s` }}>
                  {card}
                </div>
              ))}
            </div>
            <p className={revealedCards.was_lying ? 'text-accent-red text-lg' : 'text-accent-green text-lg'}>
              {revealedCards.was_lying ? '他在说谎!' : '没说谎!'}
            </p>
          </div>
        </div>
      )}

      {/* Game Over Overlay */}
      {gameOver && (
        <div className={`fixed inset-0 flex flex-col items-center justify-center z-[150] ${gameOver.winner_id === user?.id ? 'bg-gradient-to-br from-accent-green/90 to-black/90' : 'bg-gradient-to-br from-accent-red/90 to-black/90'}`}>
          <div className={`text-6xl font-black mb-4 ${gameOver.winner_id === user?.id ? 'text-accent-green text-glow-green' : 'text-accent-red text-glow-red'}`}>
            {gameOver.winner_id === user?.id ? '胜利!' : '失败'}
          </div>
          <div className="text-white text-2xl mb-8">
            获胜者: {gameOver.winner_nickname}
          </div>
          <button
            className="bg-gradient-to-r from-accent-gold to-accent-amber text-bg-primary font-bold px-8 py-3 rounded-xl active:scale-[0.97] transition-all"
            onClick={handleLeave}
          >
            返回大厅
          </button>
        </div>
      )}

      {/* Header */}
      <header className="relative z-10 flex justify-between items-center px-5 py-4 bg-bg-surface/60 backdrop-blur-md rounded-2xl mb-4 border border-border-gold/20">
        {/* Left - Room info */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
              mode === 'dice' ? 'bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30' : 'bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30'
            }`}>
              {mode === 'dice' ? '🎲' : '🃏'}
            </div>
            <div>
              <span className="text-text-primary font-semibold">
                {mode === 'dice' ? '骰子模式' : '纸牌模式'}
              </span>
              {gameStarted && (
                <span className="ml-2 text-accent-amber/80 text-sm">第 {roundNumber} 轮</span>
              )}
            </div>
          </div>
          <div className="h-8 w-px bg-border-subtle" />
          <span className="text-text-secondary/50 font-mono text-sm">#{roomId?.slice(0, 8)}</span>
        </div>

        {/* Right - Actions */}
        <div className="flex items-center gap-2">
          {/* Agent Mode Toggle */}
          <button
            className={`group flex items-center gap-2 px-3 py-2 rounded-xl border transition-all active:scale-[0.97] ${
              agentMode
                ? 'bg-accent-gold/20 border-accent-gold text-accent-gold'
                : 'border-border-subtle text-text-secondary hover:border-accent-gold/50 hover:text-accent-gold'
            }`}
            onClick={agentMode ? disableAgentMode : enableAgentMode}
          >
            <span className="text-base">{agentMode ? '🎯' : '🤖'}</span>
            <span className="text-sm hidden sm:inline">{agentMode ? '代打中' : '智能代打'}</span>
          </button>

          {/* Voice Toggle */}
          <button
            className="p-2.5 rounded-xl border border-border-subtle text-text-secondary hover:border-accent-gold/50 hover:text-accent-gold transition-all active:scale-[0.97]"
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            title={voiceEnabled ? '语音已开启' : '语音已关闭'}
          >
            {voiceEnabled ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            )}
          </button>

          {/* Copy Link */}
          <button
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border-subtle text-text-secondary hover:border-accent-gold/50 hover:text-accent-gold transition-all active:scale-[0.97]"
            onClick={handleCopyLink}
          >
            {copied ? (
              <svg className="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
            )}
            <span className="text-sm hidden sm:inline">{copied ? '已复制' : '邀请'}</span>
          </button>

          {/* Leave */}
          <button
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-elevated/50 border border-border-subtle text-text-secondary hover:border-accent-red/50 hover:text-accent-red transition-all active:scale-[0.97]"
            onClick={handleLeave}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="text-sm hidden sm:inline">离开</span>
          </button>
        </div>
      </header>

      {!gameStarted ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-bg-surface/80 to-bg-primary/50 rounded-2xl p-8 border border-border-gold/20">
          {/* Decorative cards - floating animation */}
          <div className="flex justify-center gap-2 mb-8">
            <div className="w-14 h-20 rounded-lg card-back -rotate-12 opacity-30 animate-float" style={{ animationDelay: '0ms' }} />
            <div className="w-14 h-20 rounded-lg card-back -rotate-6 opacity-40 animate-float" style={{ animationDelay: '150ms' }} />
            <div className="w-14 h-20 rounded-lg card-front flex items-center justify-center text-accent-gold/50 text-3xl font-bold opacity-60 animate-float" style={{ animationDelay: '300ms' }}>?</div>
            <div className="w-14 h-20 rounded-lg card-back rotate-6 opacity-40 animate-float" style={{ animationDelay: '450ms' }} />
            <div className="w-14 h-20 rounded-lg card-back rotate-12 opacity-30 animate-float" style={{ animationDelay: '600ms' }} />
          </div>

          <div className="text-center mb-6">
            <h2 className="text-2xl font-accent text-accent-gold tracking-wider mb-2">等待游戏开始</h2>
            <p className="text-text-secondary/50 text-sm">邀请朋友加入或添加机器人开始游戏</p>
          </div>

          {/* Player list - premium card style */}
          <div className="w-full max-w-md mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 rounded-full bg-accent-gold" />
              <span className="text-text-secondary/60 text-xs uppercase tracking-[0.2em]">玩家列表</span>
              <span className="text-text-secondary/30 text-xs">({players.length}/8)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {players.map((player) => (
                <div key={player.player_id || player.session_id} className="flex items-center gap-3 bg-bg-elevated/60 px-4 py-3 rounded-xl border border-border-subtle/50 hover:border-accent-gold/30 transition-colors group">
                  <div className="relative">
                    <AnimalAvatar avatar={player.avatar || 'fox'} size={36} />
                    {player.is_bot && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-purple-500/80 flex items-center justify-center">
                        <span className="text-[8px]">AI</span>
                      </div>
                    )}
                  </div>
                  <span className="text-text-primary font-medium text-sm truncate flex-1">{player.nickname}</span>
                </div>
              ))}
              {/* Empty slots */}
              {Array.from({ length: Math.max(0, maxPlayers - players.length) }).map((_, i) => (
                <div key={`empty-${i}`} className="flex items-center gap-3 bg-bg-elevated/30 px-4 py-3 rounded-xl border border-dashed border-border-subtle/30">
                  <div className="w-9 h-9 rounded-full bg-bg-surface/50 border border-border-subtle/30 flex items-center justify-center">
                    <span className="text-text-secondary/20 text-lg">+</span>
                  </div>
                  <span className="text-text-secondary/30 text-sm">等待加入</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 justify-center mb-6">
            {players.length < maxPlayers && (
              <button
                className="px-5 py-2.5 rounded-xl border border-border-subtle text-text-secondary hover:border-accent-gold/50 hover:text-accent-gold transition-all active:scale-[0.97] flex items-center gap-2"
                onClick={handleAddBot}
              >
                <span>🤖</span>
                <span>添加机器人</span>
              </button>
            )}
          </div>

          {players.length >= 2 ? (
            <button
              className="group relative px-10 py-4 rounded-2xl bg-gradient-to-r from-accent-gold to-accent-amber text-bg-primary font-bold text-lg active:scale-[0.97] transition-all hover:shadow-[0_0_30px_rgba(212,168,83,0.4)]"
              onClick={handleStartGame}
            >
              <span className="relative z-10 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                开始游戏
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-2 text-text-secondary/40 text-sm">
              <span className="w-2 h-2 rounded-full bg-text-secondary/30 animate-pulse" />
              <span>需要至少 2 名玩家才能开始游戏</span>
            </div>
          )}
        </div>
      ) : winnerId ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-bg-surface/80 rounded-2xl p-12 border border-border-subtle">
          <h2 className="text-4xl font-accent text-accent-gold mb-8">游戏结束!</h2>
          {winnerId === user?.id ? (
            <p className="text-accent-green text-2xl mb-8">恭喜你赢了!</p>
          ) : (
            <p className="text-accent-red text-2xl mb-8">你输了...</p>
          )}
          <button
            className="bg-gradient-to-r from-accent-gold to-accent-amber text-bg-primary font-bold px-8 py-3 rounded-xl active:scale-[0.97] transition-all"
            onClick={handleLeave}
          >
            返回大厅
          </button>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-[200px_1fr] gap-4">
          {/* Players Panel */}
          <div className="bg-gradient-to-b from-bg-surface/90 to-bg-primary/60 rounded-2xl p-4 border border-border-gold/20">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 rounded-full bg-accent-gold" />
              <h3 className="text-text-secondary/70 text-xs uppercase tracking-[0.2em] font-accent">玩家</h3>
            </div>
            <div className="flex flex-col gap-2">
              {players.map((player) => (
                <div
                  key={player.session_id}
                  className={`group relative flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    player.session_id === currentTurn
                      ? 'bg-accent-gold/10 border-accent-gold/50 shadow-[0_0_20px_rgba(212,168,83,0.2)]'
                      : 'bg-bg-elevated/40 border-transparent hover:bg-bg-elevated/60'
                  } ${!player.is_alive ? 'opacity-40 grayscale' : ''}`}
                >
                  {/* Active indicator */}
                  {player.session_id === currentTurn && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-accent-gold rounded-r-full animate-pulse" />
                  )}

                  <div className="shrink-0 relative">
                    <AnimalAvatar
                      avatar={player.avatar || 'fox'}
                      size={36}
                      dead={!player.is_alive}
                    />
                    {player.is_bot && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-purple-500/90 flex items-center justify-center border border-bg-surface">
                        <span className="text-[6px] text-white">AI</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${player.session_id === currentTurn ? 'text-accent-gold' : 'text-text-primary'}`}>
                      {player.nickname}
                    </div>
                    {player.is_alive && player.revolver && (
                      <div className="text-accent-red/60 text-xs flex items-center gap-1 mt-0.5">
                        <span>🔫</span>
                        <span className="font-mono">{player.revolver.shots_fired}/{player.revolver.chambers}</span>
                      </div>
                    )}
                    {!player.is_alive && (
                      <div className="text-text-secondary/40 text-xs flex items-center gap-1 mt-0.5">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                        <span>已淘汰</span>
                      </div>
                    )}
                  </div>

                  {player.session_id === currentTurn && (
                    <span className="shrink-0 w-2 h-2 rounded-full bg-accent-gold animate-pulse" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Game Board - Casino Table Style */}
          <div className="relative overflow-hidden rounded-2xl border-2 border-accent-gold/30 bg-gradient-to-br from-[#1a472a] via-[#0d2818] to-[#1a472a] shadow-[inset_0_0_60px_rgba(0,0,0,0.5),0_0_30px_rgba(212,168,83,0.1)]">
            {/* Table felt texture */}
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23D4A853' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }} />

            {/* Table edge glow */}
            <div className="absolute inset-0 rounded-2xl shadow-[inset_0_0_20px_rgba(212,168,83,0.15)] pointer-events-none" />

            {/* Content */}
            <div className="relative z-10 p-6">
            {mode === 'dice' ? (
              <DiceGame
                yourDice={yourDice}
                currentBid={currentBid}
                bidHistory={bidHistory}
                players={players}
                isMyTurn={isMyTurn}
                bidQuantity={bidQuantity}
                bidFace={bidFace}
                setBidQuantity={setBidQuantity}
                setBidFace={setBidFace}
                onPlaceBid={handlePlaceBid}
                onChallenge={handleChallengeBid}
              />
            ) : (
              <DeckGame
                yourHand={yourHand}
                tableCard={tableCard}
                selectedCards={selectedCards}
                setSelectedCards={setSelectedCards}
                isMyTurn={isMyTurn}
                onPlayCards={handlePlayCards}
                onCallLiar={handleCallLiar}
              />
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Dice Game Component
interface DiceGameProps {
  yourDice: number[]
  currentBid: { player_id: string; quantity: number; face_value: number } | null
  bidHistory: { player_id: string; quantity: number; face_value: number }[]
  players: { session_id: string; nickname: string }[]
  isMyTurn: boolean
  bidQuantity: number
  bidFace: number
  setBidQuantity: (v: number) => void
  setBidFace: (v: number) => void
  onPlaceBid: () => void
  onChallenge: () => void
}

function DiceGame({
  yourDice,
  currentBid,
  bidHistory,
  players,
  isMyTurn,
  bidQuantity,
  bidFace,
  setBidQuantity,
  setBidFace,
  onPlaceBid,
  onChallenge,
}: DiceGameProps) {
  // Render dice pips based on die value
  const renderDie = (value: number) => {
    const pips = []
    for (let i = 0; i < value; i++) {
      pips.push(<div key={i} className="die-pip" />)
    }
    return pips
  }

  // Get player nickname from session_id
  const getPlayerName = (sessionId: string) => {
    const player = players.find(p => p.session_id === sessionId)
    return player?.nickname || 'Unknown'
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Your dice - premium card style */}
      <div className="bg-bg-primary/40 rounded-2xl p-4 border border-border-gold/10">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 rounded-full bg-accent-gold/60" />
          <h4 className="text-text-secondary/70 text-xs uppercase tracking-[0.15em]">你的骰子</h4>
        </div>
        <div className="flex gap-2 flex-wrap">
          {yourDice.map((die, i) => (
            <div
              key={i}
              className={`die die-${die} transform transition-all hover:scale-110 hover:shadow-[0_0_15px_rgba(212,168,83,0.3)]`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              {renderDie(die)}
            </div>
          ))}
          {yourDice.length === 0 && (
            <span className="text-text-secondary/30 text-sm">暂无骰子</span>
          )}
        </div>
      </div>

      {/* Current bid - premium card */}
      {currentBid && (
        <div className="bg-gradient-to-r from-accent-gold/10 to-accent-amber/5 p-5 rounded-2xl border border-accent-gold/30">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-accent-gold/60 text-xs uppercase tracking-[0.15em]">当前报价</span>
            <span className="w-1 h-1 rounded-full bg-accent-gold animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-accent-amber text-3xl font-bold">{currentBid.quantity}</span>
            <span className="text-text-secondary text-lg">个</span>
            <div className="flex items-center gap-1">
              {Array.from({ length: currentBid.face_value }).map((_, i) => (
                <div key={i} className="w-6 h-6 rounded bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">●</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-text-secondary/60 text-sm mt-2">
            出价者: {getPlayerName(currentBid.player_id)}
          </p>
        </div>
      )}

      {/* Bid history - premium style */}
      {bidHistory.length > 0 && (
        <div className="bg-bg-primary/40 p-3 rounded-xl border border-border-gold/10">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-text-secondary/40 text-[10px] uppercase tracking-[0.15em]">报价历史</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {bidHistory.slice(-5).map((bid, i) => (
              <span key={i} className="text-xs bg-bg-elevated/60 px-3 py-1.5 rounded-lg text-text-secondary/80 border border-border-subtle/30">
                {bid.quantity} × {bid.face_value}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons - premium style */}
      {isMyTurn && (
        <div className="flex flex-col items-center gap-4 mt-2">
          <div className="flex gap-6 items-end">
            <label className="flex flex-col gap-2">
              <span className="text-text-secondary/60 text-xs uppercase tracking-[0.15em]">数量</span>
              <input
                type="number"
                min={1}
                max={20}
                value={bidQuantity}
                onChange={(e) => setBidQuantity(Number(e.target.value))}
                className="w-20 p-3 rounded-xl border border-border-gold/30 bg-bg-elevated/50 text-text-primary text-center text-lg font-semibold focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold/30 transition-all"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-text-secondary/60 text-xs uppercase tracking-[0.15em]">点数</span>
              <select
                value={bidFace}
                onChange={(e) => setBidFace(Number(e.target.value))}
                className="w-20 p-3 rounded-xl border border-border-gold/30 bg-bg-elevated/50 text-text-primary text-center text-lg font-semibold focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold/30 transition-all"
              >
                {[2, 3, 4, 5, 6].map((f) => (
                  <option key={f} value={f} className="bg-bg-surface">
                    {f}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="bg-gradient-to-r from-accent-gold to-accent-amber text-bg-primary font-bold px-8 py-3 rounded-xl active:scale-[0.97] transition-all hover:shadow-[0_0_20px_rgba(212,168,83,0.3)]"
              onClick={onPlaceBid}
            >
              出价
            </button>
          </div>
          {currentBid && (
            <button
              className="bg-gradient-to-r from-accent-red to-red-600 text-white font-bold px-6 py-3 rounded-xl active:scale-[0.97] transition-all hover:shadow-[0_0_20px_rgba(229,62,62,0.3)]"
              onClick={onChallenge}
            >
              质疑!
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Deck Game Component
interface DeckGameProps {
  yourHand: string[]
  tableCard: string
  selectedCards: number[]
  setSelectedCards: (v: number[]) => void
  isMyTurn: boolean
  onPlayCards: () => void
  onCallLiar: () => void
}

function DeckGame({
  yourHand,
  tableCard,
  selectedCards,
  setSelectedCards,
  isMyTurn,
  onPlayCards,
  onCallLiar,
}: DeckGameProps) {
  // Card display with proper styling
  const getCardDisplay = (card: string) => {
    const cardMap: Record<string, { value: string; suit: string; color: string }> = {
      'ace': { value: 'A', suit: '♠', color: 'text-white' },
      'king': { value: 'K', suit: '♠', color: 'text-white' },
      'queen': { value: 'Q', suit: '♠', color: 'text-white' },
      'joker': { value: 'J', suit: '★', color: 'text-accent-gold' },
    }
    return cardMap[card] || { value: card, suit: '', color: 'text-white' }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Table card */}
      <div>
        <h4 className="text-text-secondary mb-3">桌面牌</h4>
        <div className="w-24 h-36 rounded-xl bg-gradient-to-br from-purple-600 to-purple-800 border-2 border-accent-gold/30 flex flex-col items-center justify-center shadow-lg">
          {tableCard && (
            <>
              <span className={`text-4xl font-bold ${getCardDisplay(tableCard).color}`}>
                {getCardDisplay(tableCard).value}
              </span>
              <span className={`text-2xl ${getCardDisplay(tableCard).color}`}>
                {getCardDisplay(tableCard).suit}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Your hand */}
      <div>
        <h4 className="text-text-secondary mb-3">你的手牌 ({selectedCards.length}/3)</h4>
        <div className="flex gap-2 flex-wrap">
          {yourHand.map((card, i) => {
            const cardInfo = getCardDisplay(card)
            return (
              <div
                key={i}
                className={`w-14 h-20 flex flex-col items-center justify-center rounded-lg text-xl font-bold cursor-pointer transition-all ${
                  selectedCards.includes(i)
                    ? 'card-selected -translate-y-2'
                    : 'bg-gradient-to-br from-purple-500 to-purple-700 hover:-translate-y-1'
                }`}
                onClick={() => {
                  if (selectedCards.includes(i)) {
                    setSelectedCards(selectedCards.filter((c) => c !== i))
                  } else if (selectedCards.length < 3) {
                    setSelectedCards([...selectedCards, i])
                  }
                }}
              >
                <span className={cardInfo.color}>{cardInfo.value}</span>
                <span className={`text-sm ${cardInfo.color}`}>{cardInfo.suit}</span>
              </div>
            )
          })}
        </div>
      </div>

      {isMyTurn && (
        <div className="flex gap-4 justify-center mt-2">
          <button
            className="bg-gradient-to-r from-accent-gold to-accent-amber text-bg-primary font-semibold px-6 py-3 rounded-lg active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onPlayCards}
            disabled={selectedCards.length === 0}
          >
            出牌
          </button>
          <button
            className="bg-accent-red text-white font-semibold px-6 py-3 rounded-lg active:scale-[0.97] transition-all"
            onClick={onCallLiar}
          >
            质疑!
          </button>
        </div>
      )}
    </div>
  )
}

// ============ Complete Revolver SVG with Animations ============

interface RevolverSVGProps {
  chambers: number
  shotsFired: number
  survived?: boolean
  spinning?: boolean
  hammerFall?: boolean
  showFlash?: boolean
}

export function RevolverSVG({
  chambers = 6,
  shotsFired,
  survived = true,
  spinning = false,
  hammerFall = false,
  showFlash = false,
}: RevolverSVGProps) {
  const cylCx = 72
  const cylCy = 48
  const chamberOrbitR = 17
  const chamberR = 5

  return (
    <svg
      viewBox="0 0 240 120"
      className="revolver-svg"
      style={hammerFall && !survived ? { animation: 'gun-recoil 0.4s ease-out' } : undefined}
    >
      <defs>
        <linearGradient id="blued-steel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a1a2e" />
          <stop offset="15%" stopColor="#2a2a40" />
          <stop offset="35%" stopColor="#3d3d58" />
          <stop offset="50%" stopColor="#4a4a6a" />
          <stop offset="65%" stopColor="#3d3d58" />
          <stop offset="85%" stopColor="#2a2a40" />
          <stop offset="100%" stopColor="#1a1a2e" />
        </linearGradient>
        <linearGradient id="gunmetal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2C3539" />
          <stop offset="20%" stopColor="#3a4248" />
          <stop offset="40%" stopColor="#4a5560" />
          <stop offset="50%" stopColor="#556068" />
          <stop offset="60%" stopColor="#4a5560" />
          <stop offset="80%" stopColor="#3a4248" />
          <stop offset="100%" stopColor="#2C3539" />
        </linearGradient>
        <linearGradient id="walnut" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#6c3919" />
          <stop offset="25%" stopColor="#854c23" />
          <stop offset="50%" stopColor="#7a4420" />
          <stop offset="75%" stopColor="#5d3218" />
          <stop offset="100%" stopColor="#4a2a12" />
        </linearGradient>
        <radialGradient id="cyl-face" cx="0.4" cy="0.35" r="0.65">
          <stop offset="0%" stopColor="#3a3a50" />
          <stop offset="60%" stopColor="#2a2a3e" />
          <stop offset="100%" stopColor="#1a1a2a" />
        </radialGradient>
        <radialGradient id="ch-empty">
          <stop offset="0%" stopColor="#08080f" />
          <stop offset="80%" stopColor="#0a0a14" />
          <stop offset="100%" stopColor="#1a1a28" />
        </radialGradient>
        <radialGradient id="ch-fired">
          <stop offset="0%" stopColor="rgba(212,168,83,0.85)" />
          <stop offset="60%" stopColor="rgba(212,168,83,0.5)" />
          <stop offset="100%" stopColor="rgba(180,140,60,0.25)" />
        </radialGradient>
        <radialGradient id="ch-fatal">
          <stop offset="0%" stopColor="#ff4444" />
          <stop offset="50%" stopColor="#E53E3E" />
          <stop offset="100%" stopColor="#aa2222" />
        </radialGradient>
        <radialGradient id="mz-flash">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="20%" stopColor="#FFE4A0" />
          <stop offset="50%" stopColor="#F5C563" />
          <stop offset="80%" stopColor="#E8872A" />
          <stop offset="100%" stopColor="rgba(229,62,62,0)" />
        </radialGradient>
        <filter id="gun-shadow" x="-3%" y="-3%" width="110%" height="115%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#000" floodOpacity="0.45" />
        </filter>
      </defs>

      <g filter="url(#gun-shadow)">
        {/* Barrel */}
        <path d="M94 35 L232 35 Q235 35 235 38 L235 51 Q235 54 232 54 L94 54 Z" fill="url(#blued-steel)" />
        <rect x="94" y="49" width="141" height="5" rx="1" fill="#1a1a28" opacity="0.35" />
        <rect x="94" y="32" width="141" height="4" rx="1.5" fill="url(#gunmetal)" />
        {Array.from({ length: 18 }).map((_, i) => (
          <line key={`r${i}`} x1={100 + i * 7.5} y1="32" x2={100 + i * 7.5} y2="36" stroke="#1a1a2e" strokeWidth="0.6" opacity="0.5" />
        ))}
        <rect x="94" y="36" width="141" height="1.5" rx="0.5" fill="rgba(255,255,255,0.07)" />
        <path d="M230 28 L234 28 L233 35 L231 35 Z" fill="#4a4a5a" />
        <rect x="94" y="54" width="95" height="2.5" rx="1" fill="#2a2a3e" />
        <circle cx="189" cy="55.25" r="2" fill="#3a3a4e" stroke="#4a4a5a" strokeWidth="0.3" />

        {/* Frame */}
        <path
          d="M30 26 Q32 24 95 26 L95 56 L88 56 Q86 56 85 58 L80 100 Q79 103 76 103 L58 103 Q55 103 54.5 100 L51 65 Q50 60 48 58 L33 56 Q30 54 30 50 Z"
          fill="url(#gunmetal)" stroke="#4a4a5a" strokeWidth="0.4"
        />
        <path d="M34 27 Q36 25.5 95 27" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" />
        <line x1="92" y1="30" x2="92" y2="55" stroke="#3a3a4a" strokeWidth="0.5" opacity="0.5" />

        {/* Cylinder Window */}
        <ellipse cx={cylCx} cy={cylCy} rx="26" ry="21" fill="#06060c" />

        {/* Cylinder (rotates) */}
        <g
          className={spinning ? 'cylinder-spin' : ''}
        >
          <circle cx={cylCx} cy={cylCy} r={chamberOrbitR + 4} fill="url(#cyl-face)" />
          <circle cx={cylCx} cy={cylCy} r={chamberOrbitR + 4} fill="none" stroke="#4a4a5e" strokeWidth="0.6" />
          <circle cx={cylCx} cy={cylCy} r={chamberOrbitR + 3} fill="none" stroke="#1a1a2a" strokeWidth="0.3" />

          {Array.from({ length: chambers }).map((_, i) => {
            const a = ((i * 360) / chambers - 90 + 180 / chambers) * (Math.PI / 180)
            return (
              <line key={`f${i}`}
                x1={cylCx + (chamberOrbitR - 4) * Math.cos(a)} y1={cylCy + (chamberOrbitR - 4) * Math.sin(a)}
                x2={cylCx + (chamberOrbitR + 3) * Math.cos(a)} y2={cylCy + (chamberOrbitR + 3) * Math.sin(a)}
                stroke="#1a1a2a" strokeWidth="0.5" opacity="0.4"
              />
            )
          })}
          <circle cx={cylCx} cy={cylCy} r="3.5" fill="#1a1a2a" />
          <circle cx={cylCx} cy={cylCy} r="2.5" fill="#2a2a3e" stroke="#3a3a4e" strokeWidth="0.4" />
          <circle cx={cylCx} cy={cylCy} r="1" fill="#3a3a4e" />

          {/* Chambers */}
          {Array.from({ length: chambers }).map((_, i) => {
            const angle = (i * 360) / chambers - 90
            const cx = cylCx + chamberOrbitR * Math.cos((angle * Math.PI) / 180)
            const cy = cylCy + chamberOrbitR * Math.sin((angle * Math.PI) / 180)
            const isFatal = i === shotsFired - 1 && !survived
            const isFired = i < shotsFired
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r={chamberR + 1} fill="none"
                  stroke={isFatal ? '#ff4444' : isFired ? '#D4A853' : '#2a2a3e'} strokeWidth="0.6" />
                <circle cx={cx} cy={cy} r={chamberR}
                  fill={isFatal ? 'url(#ch-fatal)' : isFired ? 'url(#ch-fired)' : 'url(#ch-empty)'}
                  stroke={isFatal ? '#ff6666' : isFired ? '#D4A853' : '#2a2a3e'} strokeWidth="0.8" />
                {!isFired && (
                  <>
                    <circle cx={cx} cy={cy} r="2" fill="#1a1a28" />
                    <circle cx={cx} cy={cy} r="1" fill="#2a2a3e" stroke="#3a3a4a" strokeWidth="0.3" />
                  </>
                )}
                {isFatal && (
                  <circle cx={cx} cy={cy} r={chamberR + 2} fill="none" stroke="#E53E3E" strokeWidth="1" opacity="0.5">
                    <animate attributeName="r" from={`${chamberR}`} to={`${chamberR + 6}`} dur="1s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.6" to="0" dur="1s" repeatCount="indefinite" />
                  </circle>
                )}
                {isFired && !isFatal && <circle cx={cx} cy={cy} r="1.5" fill="#D4A853" opacity="0.15" />}
              </g>
            )
          })}
        </g>
        <ellipse cx={cylCx} cy={cylCy} rx="26" ry="21" fill="none" stroke="#000" strokeWidth="2" opacity="0.3" />

        {/* Hammer */}
        <g className={hammerFall ? 'hammer-fall' : ''}>
          <path d="M34 28 Q33 26 28 18 L26 14 Q25 12 27 11 L32 11 Q34 11 34 13 L38 24 Z"
            fill="url(#gunmetal)" stroke="#5a5a6a" strokeWidth="0.4" />
          <rect x="24" y="10" width="10" height="2.5" rx="0.5" fill="#4a5560" transform="rotate(-12 29 11.25)" />
        </g>

        {/* Grip */}
        <path
          d="M54 56 L84 56 Q85 56 85 57 L80 100 Q79 104 76 104 L58 104 Q55 104 54 100 L49 65 Q48 60 50 57 Z"
          fill="url(#walnut)" stroke="#3a2210" strokeWidth="0.5"
        />
        <path d="M55 57 L83 57" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />

        {/* Trigger Guard */}
        <path d="M63 56 Q61 68 63 76 Q65 82 72 82 Q79 82 81 76 L84 56"
          fill="none" stroke="url(#gunmetal)" strokeWidth="2" strokeLinecap="round" />
        <path d="M64 58 Q62 68 64 75" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
        <path d="M71 56 L71.5 68 Q71.5 72 70 73 Q68.5 74 67 72 L67 56" fill="#4a5560" stroke="#5a6570" strokeWidth="0.3" />
      </g>

      {/* Muzzle Flash */}
      {showFlash && (
        <g>
          <circle cx="237" cy="44" r="4" fill="white" opacity="0.95">
            <animate attributeName="r" from="3" to="12" dur="0.25s" fill="freeze" />
            <animate attributeName="opacity" from="0.95" to="0" dur="0.25s" fill="freeze" />
          </circle>
          <circle cx="237" cy="44" r="6" fill="url(#mz-flash)" opacity="0.85">
            <animate attributeName="r" from="4" to="28" dur="0.35s" fill="freeze" />
            <animate attributeName="opacity" from="0.85" to="0" dur="0.35s" fill="freeze" />
          </circle>
        </g>
      )}
    </svg>
  )
}

// Mini Revolver for player cards
function PlayerRevolver({ chambers, shotsFired }: { chambers: number; shotsFired: number }) {
  return (
    <div className="flex items-center gap-0.5">
      <svg width="14" height="10" viewBox="0 0 14 10">
        <rect x="6" y="3" width="8" height="2.5" rx="0.5" fill="#8B8B9E" />
        <rect x="0" y="1" width="7" height="6" rx="1" fill="#8B8B9E" />
        <rect x="2" y="6" width="3" height="3" rx="0.5" fill="#6a5a40" />
      </svg>
      {Array.from({ length: chambers }).map((_, i) => (
        <div
          key={i}
          className={`w-1 h-1 rounded-full ${i < shotsFired ? 'bg-accent-gold' : 'bg-[#2a2a3e] border border-[#4a4a5e]'}`}
        />
      ))}
    </div>
  )
}
