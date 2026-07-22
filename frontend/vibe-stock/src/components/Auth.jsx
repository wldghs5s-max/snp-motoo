import { useState } from 'react'
import { apiFetch } from '../api/client'
import './Auth.css'

const BANK_LIST = [
  { code: 'KB', name: 'KB국민은행' },
  { code: 'SHINHAN', name: '신한은행' },
  { code: 'WOORI', name: '우리은행' },
  { code: 'HANA', name: '하나은행' },
  { code: 'NH', name: 'NH농협은행' },
  { code: 'IBK', name: 'IBK기업은행' },
  { code: 'KAKAO', name: '카카오뱅크' },
  { code: 'TOSS', name: '토스뱅크' },
  { code: 'K_BANK', name: '케이뱅크' },
  { code: 'POST_OFFICE', name: '우체국' }
]

function Auth({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [bankCode, setBankCode] = useState('KB')
  const [accountNumber, setAccountNumber] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Find ID & Reset Password Modal states
  const [showFindModal, setShowFindModal] = useState(false)
  const [findModalTab, setFindModalTab] = useState('findId') // 'findId' | 'resetPw'
  const [findEmail, setFindEmail] = useState('')
  const [foundId, setFoundId] = useState('')
  
  const [resetUsername, setResetUsername] = useState('')
  const [resetEmail, setResetEmail] = useState('')
  const [resetStep, setResetStep] = useState(1) // 1: Send request, 2: Enter code & reset
  const [verificationCode, setVerificationCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [mockCodeToShow, setMockCodeToShow] = useState('')
  const [findModalError, setFindModalError] = useState('')
  const [findModalSuccess, setFindModalSuccess] = useState('')
  const [findModalLoading, setFindModalLoading] = useState(false)

  // Reactivate Account Modal states
  const [showReactivateModal, setShowReactivateModal] = useState(false)
  const [reactivateUsername, setReactivateUsername] = useState('')
  const [reactivatePassword, setReactivatePassword] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!username.trim() || !password.trim()) {
      setError('아이디와 비밀번호를 모두 입력해 주세요.')
      return
    }

    if (!isLogin) {
      if (!nickname.trim() || !email.trim() || !accountNumber.trim()) {
        setError('모든 필수 정보를 입력해 주세요.')
        return
      }
      if (password !== confirmPassword) {
        setError('비밀번호가 일치하지 않습니다.')
        return
      }
    }

    setLoading(true)
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup'
    const body = isLogin
      ? { username, password }
      : { username, password, nickname, email, bankCode, accountNumber }

    try {
      const data = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      })

      if (data && data.accessToken) {
        localStorage.setItem('token', data.accessToken)
        localStorage.setItem('username', data.username)
        localStorage.setItem('nickname', data.nickname || data.username)
        localStorage.setItem('email', data.email || '')
        localStorage.setItem('bankCode', data.bankCode || '')
        localStorage.setItem('bankName', data.bankName || '')
        localStorage.setItem('accountNumber', data.accountNumber || '')
        onLoginSuccess(data.username)
      } else {
        setError('로그인 처리에 실패했습니다.')
      }
    } catch (err) {
      console.error(err)
      if (err.message.includes('ACCOUNT_WITHDRAWN')) {
        // Trigger Reactivate Account Modal
        setReactivateUsername(username)
        setReactivatePassword(password)
        setShowReactivateModal(true)
      } else {
        setError(err.message || '인증 요청이 실패했습니다. 정보를 확인해 주세요.')
      }
    } finally {
      setLoading(false)
    }
  }

  // Reactivate Account Handler
  const handleReactivate = async () => {
    setError('')
    setLoading(true)
    setShowReactivateModal(false)
    try {
      const data = await apiFetch('/api/auth/reactivate', {
        method: 'POST',
        body: JSON.stringify({ username: reactivateUsername, password: reactivatePassword }),
      })

      if (data && data.accessToken) {
        localStorage.setItem('token', data.accessToken)
        localStorage.setItem('username', data.username)
        localStorage.setItem('nickname', data.nickname || data.username)
        localStorage.setItem('email', data.email || '')
        localStorage.setItem('bankCode', data.bankCode || '')
        localStorage.setItem('bankName', data.bankName || '')
        localStorage.setItem('accountNumber', data.accountNumber || '')
        onLoginSuccess(data.username)
      }
    } catch (err) {
      setError(err.message || '계정 재활성화에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // Find ID Handler
  const handleFindId = async (e) => {
    e.preventDefault()
    setFindModalError('')
    setFoundId('')
    setFindModalLoading(true)

    try {
      const data = await apiFetch('/api/auth/find-id', {
        method: 'POST',
        body: JSON.stringify({ email: findEmail }),
      })
      if (data && data.username) {
        setFoundId(data.username)
      }
    } catch (err) {
      setFindModalError(err.message || '아이디 찾기에 실패했습니다.')
    } finally {
      setFindModalLoading(false)
    }
  }

  // Password Reset Request Handler
  const handleResetRequest = async (e) => {
    e.preventDefault()
    setFindModalError('')
    setFindModalSuccess('')
    setMockCodeToShow('')
    setFindModalLoading(true)

    try {
      const data = await apiFetch('/api/auth/reset-password/request', {
        method: 'POST',
        body: JSON.stringify({ username: resetUsername, email: resetEmail }),
      })
      if (data && data.verificationCode) {
        setMockCodeToShow(data.verificationCode)
        setFindModalSuccess('인증 코드가 이메일로 발송되었습니다.')
        setResetStep(2)
      }
    } catch (err) {
      setFindModalError(err.message || '비밀번호 재설정 요청에 실패했습니다.')
    } finally {
      setFindModalLoading(false)
    }
  }

  // Password Reset Confirm Handler
  const handleResetConfirm = async (e) => {
    e.preventDefault()
    setFindModalError('')
    setFindModalSuccess('')
    setFindModalLoading(true)

    try {
      await apiFetch('/api/auth/reset-password/confirm', {
        method: 'POST',
        body: JSON.stringify({
          username: resetUsername,
          email: resetEmail,
          code: verificationCode,
          newPassword: newPassword,
        }),
      })
      setFindModalSuccess('비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.')
      setTimeout(() => {
        closeFindModal()
      }, 2500)
    } catch (err) {
      setFindModalError(err.message || '비밀번호 재설정에 실패했습니다.')
    } finally {
      setFindModalLoading(false)
    }
  }

  const closeFindModal = () => {
    setShowFindModal(false)
    setFindModalError('')
    setFindModalSuccess('')
    setFindEmail('')
    setFoundId('')
    setResetUsername('')
    setResetEmail('')
    setResetStep(1)
    setVerificationCode('')
    setNewPassword('')
    setMockCodeToShow('')
  }

  const handleToggleMode = () => {
    setIsLogin(!isLogin)
    setUsername('')
    setPassword('')
    setConfirmPassword('')
    setNickname('')
    setEmail('')
    setAccountNumber('')
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
            <>
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

              <div className="auth-form__group animate-fade-in">
                <label htmlFor="nickname" className="auth-form__label">닉네임</label>
                <input
                  type="text"
                  id="nickname"
                  className="auth-form__input"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="사용할 닉네임을 입력하세요 (2~20자)"
                  maxLength={20}
                  required
                />
              </div>

              <div className="auth-form__group animate-fade-in">
                <label htmlFor="email" className="auth-form__label">이메일 주소</label>
                <input
                  type="email"
                  id="email"
                  className="auth-form__input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="이메일 주소를 입력하세요"
                  required
                />
              </div>

              <div className="auth-form__group animate-fade-in">
                <label htmlFor="bankSelect" className="auth-form__label">출금 계좌 은행</label>
                <select
                  id="bankSelect"
                  className="auth-form__input"
                  value={bankCode}
                  onChange={(e) => setBankCode(e.target.value)}
                  style={{ appearance: 'none', background: '#171e2e url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23ffffff\'%3E%3Cpath d=\'M7 10l5 5 5-5H7z\'/%3E%3C/svg%3E") no-repeat right 12px center', backgroundSize: '16px' }}
                >
                  {BANK_LIST.map((b) => (
                    <option key={b.code} value={b.code} style={{ background: '#111827', color: '#fff' }}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="auth-form__group animate-fade-in">
                <label htmlFor="accountNumber" className="auth-form__label">계좌번호</label>
                <input
                  type="text"
                  id="accountNumber"
                  className="auth-form__input"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="계좌번호를 입력하세요 (숫자 및 하이픈)"
                  required
                />
              </div>
            </>
          )}

          {isLogin && (
            <div className="auth-form__help">
              <button
                type="button"
                className="auth-form__help-link"
                onClick={() => setShowFindModal(true)}
              >
                아이디 또는 비밀번호를 잊으셨나요?
              </button>
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

      {/* FIND CREDENTIALS MODAL */}
      {showFindModal && (
        <div className="auth-modal-overlay">
          <div className="auth-modal-card">
            <div className="auth-modal-header">
              <h3 className="auth-modal-title">🔐 아이디 / 비밀번호 찾기</h3>
              <button className="auth-modal-close" onClick={closeFindModal}>&times;</button>
            </div>
            
            <div className="auth-modal-tabs">
              <button
                className={`auth-modal-tab-btn ${findModalTab === 'findId' ? 'auth-modal-tab-btn--active' : ''}`}
                onClick={() => { setFindModalTab('findId'); setFindModalError(''); setFindModalSuccess(''); }}
              >
                아이디 찾기
              </button>
              <button
                className={`auth-modal-tab-btn ${findModalTab === 'resetPw' ? 'auth-modal-tab-btn--active' : ''}`}
                onClick={() => { setFindModalTab('resetPw'); setFindModalError(''); setFindModalSuccess(''); }}
              >
                비밀번호 재설정
              </button>
            </div>

            <div className="auth-modal-body">
              {findModalError && <div className="auth-card__error" style={{ marginBottom: '15px' }}>{findModalError}</div>}
              {findModalSuccess && <div style={{ color: '#34d399', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '10px 14px', borderRadius: '12px', fontSize: '13.5px', marginBottom: '15px' }}>{findModalSuccess}</div>}

              {findModalTab === 'findId' ? (
                <form onSubmit={handleFindId} className="auth-form">
                  <div className="auth-form__group">
                    <label className="auth-form__label">이메일 주소</label>
                    <input
                      type="email"
                      className="auth-form__input"
                      value={findEmail}
                      onChange={(e) => setFindEmail(e.target.value)}
                      placeholder="가입 시 입력했던 이메일을 입력하세요"
                      required
                    />
                  </div>
                  {foundId && (
                    <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '12px', textAlign: 'center', marginTop: '16px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <span style={{ fontSize: '13px', color: '#9ca3af' }}>해당 이메일로 가입된 아이디는:</span>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#6366f1', marginTop: '6px', letterSpacing: '0.5px' }}>{foundId}</div>
                    </div>
                  )}
                  <button type="submit" className="auth-form__submit" style={{ marginTop: '10px' }} disabled={findModalLoading}>
                    {findModalLoading ? '검색 중...' : '아이디 찾기'}
                  </button>
                </form>
              ) : (
                // Reset Password
                <div>
                  {resetStep === 1 ? (
                    <form onSubmit={handleResetRequest} className="auth-form">
                      <div className="auth-form__group">
                        <label className="auth-form__label">아이디</label>
                        <input
                          type="text"
                          className="auth-form__input"
                          value={resetUsername}
                          onChange={(e) => setResetUsername(e.target.value)}
                          placeholder="아이디를 입력하세요"
                          required
                        />
                      </div>
                      <div className="auth-form__group">
                        <label className="auth-form__label">이메일 주소</label>
                        <input
                          type="email"
                          className="auth-form__input"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          placeholder="이메일 주소를 입력하세요"
                          required
                        />
                      </div>
                      <button type="submit" className="auth-form__submit" style={{ marginTop: '10px' }} disabled={findModalLoading}>
                        {findModalLoading ? '인증 코드 생성 중...' : '인증번호 발송'}
                      </button>
                    </form>
                  ) : (
                    // Step 2: Verification
                    <form onSubmit={handleResetConfirm} className="auth-form">
                      {mockCodeToShow && (
                        <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '14px', borderRadius: '12px', fontSize: '13px', marginBottom: '15px', color: '#a5b4fc', textAlign: 'left', lineHeight: '1.5' }}>
                          💡 <strong>[테스트 안내]</strong> 이메일 발송을 우회하여 테스트 인증번호를 출력합니다:
                          <div style={{ fontSize: '18px', fontWeight: '800', color: '#818cf8', marginTop: '6px', letterSpacing: '2px', textAlign: 'center' }}>{mockCodeToShow}</div>
                        </div>
                      )}
                      <div className="auth-form__group">
                        <label className="auth-form__label">인증번호</label>
                        <input
                          type="text"
                          className="auth-form__input"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value)}
                          placeholder="6자리 인증번호를 입력하세요"
                          required
                        />
                      </div>
                      <div className="auth-form__group">
                        <label className="auth-form__label">새 비밀번호</label>
                        <input
                          type="password"
                          className="auth-form__input"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="새로 사용할 비밀번호를 입력하세요 (최소 8자)"
                          required
                        />
                      </div>
                      <button type="submit" className="auth-form__submit" style={{ marginTop: '10px' }} disabled={findModalLoading}>
                        {findModalLoading ? '비밀번호 재설정 중...' : '비밀번호 변경 완료'}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ACCOUNT REACTIVATION MODAL */}
      {showReactivateModal && (
        <div className="auth-modal-overlay">
          <div className="auth-modal-card" style={{ maxWidth: '420px', textAlign: 'center' }}>
            <div className="auth-modal-header" style={{ justifyContent: 'center', borderBottom: 'none', paddingBottom: 0 }}>
              <h3 className="auth-modal-title">♻️ 탈퇴 계정 안내</h3>
            </div>
            <div className="auth-modal-body" style={{ marginTop: '16px' }}>
              <p style={{ fontSize: '14px', lineHeight: '1.6', marginBottom: '24px', color: '#9ca3af', textAlign: 'center' }}>
                해당 아이디는 현재 <strong>회원 탈퇴 처리된 계정</strong>입니다.<br/>
                정보를 복구하고 계정을 다시 <strong>재활성화</strong>하시겠습니까?
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={handleReactivate}
                  className="auth-form__submit"
                  style={{ background: 'linear-gradient(90deg, #10b981, #059669)', margin: 0, flex: 1, boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}
                >
                  네, 계정 복구하기
                </button>
                <button
                  onClick={() => setShowReactivateModal(false)}
                  className="auth-form__submit"
                  style={{ background: '#374151', margin: 0, flex: 1, boxShadow: 'none' }}
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default Auth

