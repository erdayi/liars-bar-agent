import { useState } from 'react'
import { api } from '../api/http'

interface LoginPageProps {
  onLogin?: (token: string, userData: any) => void
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async () => {
    try {
      setLoading(true)
      setError(null)
      const { authorization_url } = await api.getLoginUrl()
      // Redirect to SecondMe OAuth
      window.location.href = authorization_url
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-speakeasy bg-noise">
      {/* Ambient light orbs */}
      <div className="ambient-light" />

      {/* Decorative cards */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="deco-card text-accent-gold/40 -rotate-[25deg]" style={{ top: '12%', left: '6%' }}>
          <span>A</span>
        </div>
        <div className="deco-card text-accent-red/30 rotate-[15deg]" style={{ top: '8%', right: '8%' }}>
          <span>K</span>
        </div>
        <div className="deco-card text-accent-gold/30 rotate-[35deg]" style={{ bottom: '15%', left: '10%' }}>
          <span>Q</span>
        </div>
        <div className="deco-card text-accent-gold/25 -rotate-[10deg]" style={{ bottom: '20%', right: '5%' }}>
          <span>{'\u2605'}</span>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-8">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="ornament text-accent-gold/30 mb-4">
            <span className="text-xs tracking-[0.3em] uppercase text-accent-gold/50">Est. 2026</span>
          </div>
          <h1
            className="text-5xl sm:text-6xl font-accent text-accent-gold tracking-wider text-glow-gold"
            style={{ animation: 'pulse-gold 3s ease-in-out infinite' }}
          >
            LIAR'S BAR
          </h1>
          <p className="text-text-secondary text-sm tracking-[0.25em] uppercase">
            Where trust goes to die
          </p>
          <p className="text-text-secondary text-sm">骗子酒馆</p>
          <div className="ornament text-accent-gold/30 mt-2">
            <span className="text-accent-gold/20 text-xs">&#9830;</span>
          </div>
        </div>

        {error && (
          <p className="text-accent-red text-sm text-center bg-accent-red/5 border border-accent-red/20 rounded-xl py-2 px-3">
            {error}
          </p>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-gradient-to-r from-accent-gold to-accent-amber rounded-2xl py-4 text-bg-primary font-bold text-lg tracking-wide uppercase transition-all duration-300 hover:glow-gold-lg disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.97]"
        >
          {loading ? '登录中...' : '使用 SecondMe 登录'}
        </button>

        {/* Bottom hint */}
        <p className="text-text-secondary/30 text-xs tracking-wider">
          需要 SecondMe 账号才能参与游戏
        </p>
      </div>
    </div>
  )
}
