import { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard'
import Auth from './components/Auth'

function App() {
  const [username, setUsername] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const savedUsername = localStorage.getItem('username')
    if (token && savedUsername) {
      setUsername(savedUsername)
    }
    setLoading(false)
  }, [])

  const handleLoginSuccess = (user) => {
    setUsername(user)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    localStorage.removeItem('nickname')
    localStorage.removeItem('email')
    localStorage.removeItem('bankCode')
    localStorage.removeItem('bankName')
    localStorage.removeItem('accountNumber')
    setUsername(null)
  }


  if (loading) {
    return (
      <div style={{
        background: '#0b0f19',
        color: '#fff',
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'sans-serif'
      }}>
        로딩 중...
      </div>
    )
  }

  if (!username) {
    return <Auth onLoginSuccess={handleLoginSuccess} />
  }

  return <Dashboard username={username} onLogout={handleLogout} />
}

export default App
