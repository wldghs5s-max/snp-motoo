import { useState } from 'react'
import { apiFetch } from '../api/client'
import './Auth.css'

function Auth({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!username.trim() || !password.trim()) {
      setError('아이디와 비밀번호를 모두 입력해 주세요.')
      return
    }

    if (!isLogin && password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    setLoading(true)
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup'
    const body = isLogin ? { username, password } : { username, password } // Same request format for this API

    try {
      const data = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      })

      if (data && data.accessToken) {
        localStorage.setItem('token', data.accessToken)
        localStorage.setItem('username', data.username)
        onLoginSuccess(data.username)
      } else {
        setError('로그인 처리에 실패했습니다.')
      }
    } catch (err) {
      console.error(err)
      setError(err.message || '인증 요청이 실패했습니다. 정보를 확인해 주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleMode = () => {
    setIsLogin(!isLogin)
    setUsername('')
    setPassword('')
    setConfirmPassword('')
    setError('')
  }

  return (
    <div className="auth-container">
      <div className="auth-glow auth-glow--primary"></div>
      <div className="auth-glow auth-glow--secondary"></div>

      <div className="auth-card">
        <div className="auth-card__brand">
          <span className="auth-card__logo" aria-hidden="true">VS</span>
          <h1 className="auth-card__title">Vibe Stock</h1>
          <p className="auth-card__subtitle">실시간 주식 모의투자 플랫폼</p>
        </div>

        <h2 className="auth-card__heading">
          {isLogin ? '로그인' : '회원가입'}
        </h2>

        {error && <div className="auth-card__error" role="alert">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-form__group">
            <label htmlFor="username" className="auth-form__label">아이디</label>
            <input
              type="text"
              id="username"
              className="auth-form__input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="아이디를 입력하세요 (최대 20자)"
              maxLength={20}
              required
            />
          </div>

          <div className="auth-form__group">
            <label htmlFor="password" className="auth-form__label">비밀번호</label>
            <input
              type="password"
              id="password"
              className="auth-form__input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              required
            />
          </div>

          {!isLogin && (
            <div className="auth-form__group animate-fade-in">
              <label htmlFor="confirmPassword" className="auth-form__label">비밀번호 확인</label>
              <input
                type="password"
                id="confirmPassword"
                className="auth-form__input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="비밀번호를 다시 입력하세요"
                required
              />
            </div>
          )}

          <button type="submit" className="auth-form__submit" disabled={loading}>
            {loading ? '처리 중...' : isLogin ? '로그인' : '회원가입'}
          </button>
        </form>

        <div className="auth-card__toggle">
          <p className="auth-card__toggle-text">
            {isLogin ? '처음이신가요?' : '이미 계정이 있으신가요?'}
          </p>
          <button onClick={handleToggleMode} className="auth-card__toggle-btn">
            {isLogin ? '회원가입 하기' : '로그인 하기'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Auth
