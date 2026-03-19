import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import LoginPage from './pages/LoginPage'
import LobbyPage from './pages/LobbyPage'
import GamePage from './pages/GamePage'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for token in URL hash
    const hash = window.location.hash
    if (hash && hash.includes('token=')) {
      const tokenPart = hash.split('token=')[1]
      const tokenParam = tokenPart ? tokenPart.split('&')[0] : null

      if (tokenParam) {
        try {
          // Decode token payload
          const payload = JSON.parse(atob(tokenParam.split('.')[1]))

          const newUser = {
            id: payload.sub,
            username: payload.username,
            email: payload.user_id || '',
            avatar: payload.avatar || 'fox',
            points: 100,
            games_played: 0,
            games_won: 0
          }

          // Save to localStorage
          localStorage.setItem('token', tokenParam)
          localStorage.setItem('user', JSON.stringify(newUser))

          // Clear hash
          window.location.hash = ''

          // Redirect to lobby
          window.location.href = '/lobby'
          return
        } catch (e) {
          console.error('Token parse error:', e)
        }
      }
    }

    // Check localStorage for existing session
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (token && savedUser) {
      setIsLoggedIn(true)
      setUser(JSON.parse(savedUser))
    }

    setLoading(false)
  }, [])

  const handleLogin = (token: string, userData: any) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
    setIsLoggedIn(true)
    setUser(userData)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setIsLoggedIn(false)
    setUser(null)
  }

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>加载中...</div>
  }

  return (
    <div className="bg-speakeasy">
      <div className="ambient-light" />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={
            isLoggedIn ? <Navigate to="/lobby" replace /> : <LoginPage onLogin={handleLogin} />
          } />
          <Route
            path="/lobby"
            element={
              isLoggedIn ? <LobbyPage user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />
            }
          />
          <Route
            path="/game/:roomId"
            element={
              isLoggedIn ? <GamePage user={user} /> : <Navigate to="/" replace />
            }
          />
        </Routes>
      </BrowserRouter>
    </div>
  )
}

export default App
