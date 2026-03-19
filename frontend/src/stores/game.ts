import { create } from 'zustand'
import { gameAudio } from '../audio/sounds'

interface Player {
  session_id: string
  player_id?: string
  nickname: string
  avatar: string
  is_alive: boolean
  is_bot?: boolean
  revolver?: {
    chambers: number
    shots_fired: number
  }
}

// Roulette result state
interface RouletteResult {
  player_id: string
  survived: boolean
  shots_fired: number
  chambers: number
}

// Revealed cards state
interface RevealedCards {
  cards: string[]
  was_lying: boolean
  challenger_id: string
  challenged_id: string
}

// Revealed dice state
interface RevealedDice {
  all_dice: Record<string, number[]>
  actual_count: number
  bid_was_correct: boolean
  challenger_id: string
  challenged_id: string
}

// Game over state
interface GameOver {
  winner_id: string
  winner_nickname: string
  winner_avatar?: string
}

interface GameState {
  // Room state
  roomId: string | null
  mode: 'deck' | 'dice' | null
  players: Player[]
  gameStarted: boolean
  maxPlayers: number

  // Game state
  phase: string
  roundNumber: number
  currentTurn: string | null
  yourDice: number[]
  yourHand: string[]
  tableCard: string
  currentBid: { player_id: string; quantity: number; face_value: number } | null
  bidHistory: { player_id: string; quantity: number; face_value: number }[]
  eliminated: string[]
  winnerId: string | null

  // Animation states
  rouletteResult: RouletteResult | null
  revealedCards: RevealedCards | null
  revealedDice: RevealedDice | null
  gameOver: GameOver | null
  liarCalled: { caller_id: string } | null

  // UI states
  showLiarCall: boolean
  showRoulette: boolean

  // Actions
  setRoomState: (state: Partial<GameState>) => void
  setGameState: (state: Partial<GameState>) => void

  // Animation actions
  setRouletteResult: (result: RouletteResult | null) => void
  setRevealedCards: (result: RevealedCards | null) => void
  setRevealedDice: (result: RevealedDice | null) => void
  setGameOver: (result: GameOver | null) => void
  setLiarCalled: (caller: { caller_id: string } | null) => void
  clearAnimations: () => void

  // Play sounds
  playTick: () => void
  playClick: () => void
  playBang: () => void
  playHeartbeat: () => void
  playLiarSting: () => void
  playCardFlip: () => void
  playDiceRoll: () => void
  playWin: () => void
  playLose: () => void

  reset: () => void
}

export const useGameStore = create<GameState>((set, get) => ({
  roomId: null,
  mode: null,
  players: [],
  gameStarted: false,
  maxPlayers: 8,
  phase: '',
  roundNumber: 0,
  currentTurn: null,
  yourDice: [],
  yourHand: [],
  tableCard: '',
  currentBid: null,
  bidHistory: [],
  eliminated: [],
  winnerId: null,

  // Animation states
  rouletteResult: null,
  revealedCards: null,
  revealedDice: null,
  gameOver: null,
  liarCalled: null,

  // UI states
  showLiarCall: false,
  showRoulette: false,

  setRoomState: (state) => set(state),
  setGameState: (state) => {
    // Play sounds based on state changes
    const prevState = get()
    if (state.phase === 'playing' && prevState.phase !== 'playing') {
      gameAudio.init()
    }
    if (state.currentTurn && state.currentTurn !== prevState.currentTurn) {
      gameAudio.heartbeat()
    }
    set(state)
  },

  setRouletteResult: (result) => {
    if (result) {
      if (result.survived) {
        gameAudio.click()
      } else {
        gameAudio.bang()
      }
    }
    set({ rouletteResult: result, showRoulette: !!result })
  },

  setRevealedCards: (result) => {
    if (result) {
      if (result.was_lying) {
        gameAudio.liarSting()
      } else {
        gameAudio.click()
      }
    }
    set({ revealedCards: result })
  },

  setRevealedDice: (result) => {
    if (result) {
      if (!result.bid_was_correct) {
        gameAudio.liarSting()
      } else {
        gameAudio.click()
      }
    }
    set({ revealedDice: result })
  },

  setGameOver: (result) => {
    if (result) {
      // Check if current user won
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      if (result.winner_id === user.id) {
        gameAudio.win()
      } else {
        gameAudio.lose()
      }
    }
    set({ gameOver: result, winnerId: result?.winner_id || null })
  },

  setLiarCalled: (caller) => {
    if (caller) {
      gameAudio.liarSting()
    }
    set({ liarCalled: caller, showLiarCall: !!caller })
  },

  clearAnimations: () => set({
    rouletteResult: null,
    revealedCards: null,
    revealedDice: null,
    showLiarCall: false,
    showRoulette: false,
  }),

  // Sound effects
  playTick: () => gameAudio.tick(),
  playClick: () => gameAudio.click(),
  playBang: () => gameAudio.bang(),
  playHeartbeat: () => gameAudio.heartbeat(),
  playLiarSting: () => gameAudio.liarSting(),
  playCardFlip: () => gameAudio.cardFlip(),
  playDiceRoll: () => gameAudio.diceRoll(),
  playWin: () => gameAudio.win(),
  playLose: () => gameAudio.lose(),

  reset: () => set({
    roomId: null,
    mode: null,
    players: [],
    gameStarted: false,
    phase: '',
    roundNumber: 0,
    currentTurn: null,
    yourDice: [],
    yourHand: [],
    tableCard: '',
    currentBid: null,
    bidHistory: [],
    eliminated: [],
    winnerId: null,
    rouletteResult: null,
    revealedCards: null,
    revealedDice: null,
    gameOver: null,
    liarCalled: null,
    showLiarCall: false,
    showRoulette: false,
  }),
}))
